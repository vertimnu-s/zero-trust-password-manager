import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string
};

export const userPool = new CognitoUserPool(poolData);

export const loginUser = (identifier: string, password: string) => {
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
        resolve(result.getIdToken().getJwtToken());
      },

      onFailure: (err) => {
        reject(err);
      },

      newPasswordRequired: (userAttributes, requiredAttributes) => {
        const newPassword = prompt("Enter new password") || "";

        console.log("Required attributes:", requiredAttributes);
        console.log("User attributes:", userAttributes);

        const attributes: Record<string, string> = {};

        // Loop through ALL required attributes
        requiredAttributes.forEach((attr: string) => {
          let value = "";

          // If Cognito already has a value (like email), use it
          if (userAttributes[attr]) {
            value = userAttributes[attr];
          } else {
            value = prompt(`Enter ${attr}`) || "";
          }

          attributes[attr] = value;
        });

        user.completeNewPasswordChallenge(newPassword, attributes, {
          onSuccess: (result) => {
            resolve(result.getIdToken().getJwtToken());
          },
          onFailure: (err) => {
            console.error("Challenge error:", err);
            reject(err);
          }
        });
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
