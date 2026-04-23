import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string
};

export const userPool = new CognitoUserPool(poolData);

export interface MFAChallengeState {
  mfaRequired: boolean;
  challengeName?: string;
}

const COGNITO_REGION = import.meta.env.VITE_AWS_REGION;

interface MfaSetupResult {
  secretCode: string;
  accessToken: string;
}

let pendingMfaUser: CognitoUser | null = null;

const callCognitoIdp = async <T>(
  target: string,
  payload: Record<string, unknown>
): Promise<T> => {
  const response = await fetch(
    `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message: string }).message
        : `Cognito error: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
};

const getAccessToken = (cognitoUser: CognitoUser): Promise<string> => {
  return new Promise((resolve, reject) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err);
        return;
      }
      if (!session) {
        reject(new Error('No active session.'));
        return;
      }
      resolve(session.getAccessToken().getJwtToken());
    });
  });
};

export const loginUser = (identifier: string, password: string): Promise<string | MFAChallengeState> => {
  return new Promise((resolve, reject) => {
    pendingMfaUser = null;

    const user = new CognitoUser({
      Username: identifier,
      Pool: userPool
    });

    const authDetails = new AuthenticationDetails({
      Username: identifier,
      Password: password
    });

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        localStorage.setItem("refreshToken", result.getRefreshToken().getToken());
        resolve(result.getIdToken().getJwtToken());
      },

      onFailure: (err) => {
        pendingMfaUser = null;
        reject(err);
      },

      mfaRequired: (challengeName) => {
        pendingMfaUser = user;
        resolve({
          mfaRequired: true,
          challengeName
        });
      },

      totpRequired: () => {
        pendingMfaUser = user;
        resolve({
          mfaRequired: true,
          challengeName: 'SOFTWARE_TOKEN_MFA'
        });
      },

      newPasswordRequired: () => {
        pendingMfaUser = null;
        reject(new Error("Password change required. Please contact support."));
      }
    });
  });
};

export const completeMFAChallenge = (mfaCode: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!pendingMfaUser) {
      reject(new Error("No pending MFA challenge. Please log in again."));
      return;
    }

    pendingMfaUser.sendMFACode(mfaCode, {
      onSuccess: (result) => {
        localStorage.setItem("refreshToken", result.getRefreshToken().getToken());
        pendingMfaUser = null;
        resolve(result.getIdToken().getJwtToken());
      },

      onFailure: (err) => {
        reject(err);
      }
    }, "SOFTWARE_TOKEN_MFA");
  });
};

export const clearPendingMFA = (): void => {
  pendingMfaUser = null;
};

export const registerUser = (
  identifier: string,
  password: string,
  email: string,
  preferredUsername: string
) => {
  return new Promise((resolve, reject) => {
      const emailAttr = new CognitoUserAttribute({
        Name: "email",
        Value: email,
      });
      const preferredUsernameAttr = new CognitoUserAttribute({
        Name: "preferred_username",
        Value: preferredUsername,
      });
      userPool.signUp(
      identifier,
      password,
      [emailAttr, preferredUsernameAttr],
      [],
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        if (result?.user) {
          resolve(result.user.getUsername());
          return;
        }
        reject(new Error("Registration failed"));
      }
    );
  });
};

export const confirmUser = (username: string, code: string) => {
  const user = new CognitoUser({ Username: username, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

export const resendConfirmationCode = (username: string) => {
  const user = new CognitoUser({ Username: username, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.resendConfirmationCode((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

export const changePassword = (oldPassword: string, newPassword: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      reject(new Error("No user session found. Please log in again."));
      return;
    }

    cognitoUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
        if (err) reject(err);
        else resolve(result || "SUCCESS");
      });
    });
  });
};

export const logoutUser = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      localStorage.removeItem("idToken");
      localStorage.removeItem("refreshToken");
      resolve();
      return;
    }

    cognitoUser.getSession((err: Error | null) => {
      if (err) {
        localStorage.removeItem("idToken");
        localStorage.removeItem("refreshToken");
        resolve();
        return;
      }

      cognitoUser.globalSignOut({
        onSuccess: () => {
          localStorage.removeItem("idToken");
          localStorage.removeItem("refreshToken");
          resolve();
        },
        onFailure: (err) => {
          localStorage.removeItem("idToken");
          localStorage.removeItem("refreshToken");
          reject(err);
        }
      });
    });
  });
};

export const globalSignOutUser = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      reject(new Error("No user session found."));
      return;
    }

    cognitoUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      cognitoUser.globalSignOut({
        onSuccess: () => {
          localStorage.removeItem("idToken");
          localStorage.removeItem("refreshToken");
          resolve();
        },
        onFailure: (err) => reject(err)
      });
    });
  });
};

export const refreshSession = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      reject(new Error("No user session found."));
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        reject(err || new Error("No session."));
        return;
      }

      if (session.isValid()) {
        resolve(session.getIdToken().getJwtToken());
        return;
      }

      const refreshToken = session.getRefreshToken();
      cognitoUser.refreshSession(refreshToken, (err, newSession: CognitoUserSession) => {
        if (err) {
          reject(err);
          return;
        }
        const newIdToken = newSession.getIdToken().getJwtToken();
        localStorage.setItem("idToken", newIdToken);
        localStorage.setItem("refreshToken", newSession.getRefreshToken().getToken());
        resolve(newIdToken);
      });
    });
  });
};

export const deleteAccount = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      reject(new Error("No user session found."));
      return;
    }

    cognitoUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      cognitoUser.deleteUser((err) => {
        if (err) {
          reject(err);
          return;
        }
        localStorage.removeItem("idToken");
        localStorage.removeItem("refreshToken");
        resolve();
      });
    });
  });
};

export const setUpMFA = async (): Promise<MfaSetupResult> => {
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) {
    throw new Error('No user session found.');
  }

  const accessToken = await getAccessToken(cognitoUser);

  const response = await callCognitoIdp<{ SecretCode: string }>(
    'AssociateSoftwareToken',
    { AccessToken: accessToken }
  );

  return {
    secretCode: response.SecretCode,
    accessToken,
  };
};

export const verifyMFAToken = async (
  accessToken: string,
  totpToken: string
): Promise<void> => {
  await callCognitoIdp<Record<string, unknown>>('VerifySoftwareToken', {
    AccessToken: accessToken,
    UserCode: totpToken,
    FriendlyDeviceName: 'AuthenticatorApp',
  });

  await callCognitoIdp<Record<string, unknown>>('SetUserMFAPreference', {
    AccessToken: accessToken,
    SMSMfaSettings: null,
    SoftwareTokenMfaSettings: {
      Enabled: true,
      PreferredMfa: true,
    },
  });
};

export const disableMFA = async (): Promise<void> => {
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) {
    throw new Error('No user session found.');
  }

  const accessToken = await getAccessToken(cognitoUser);

  await callCognitoIdp<Record<string, unknown>>('SetUserMFAPreference', {
    AccessToken: accessToken,
    SMSMfaSettings: null,
    SoftwareTokenMfaSettings: {
      Enabled: false,
      PreferredMfa: false,
    },
  });
};

export const checkMFAStatus = async (): Promise<boolean> => {
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) {
    return false;
  }

  try {
    const accessToken = await getAccessToken(cognitoUser);
    const response = await callCognitoIdp<{
      UserMFASettingList?: Array<string>;
    }>('GetUser', {
      AccessToken: accessToken,
    });

    return Array.isArray(response.UserMFASettingList) && 
           response.UserMFASettingList.includes('SOFTWARE_TOKEN_MFA');
  } catch (error) {
    console.error('Failed to check MFA status:', error);
    return false;
  }
};