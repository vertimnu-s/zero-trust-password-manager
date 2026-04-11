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

export const loginUser = (identifier: string, password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
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
        reject(err);
      },

      newPasswordRequired: () => {
        reject(new Error("Password change required. Please contact support."));
      }
    });
  });
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
