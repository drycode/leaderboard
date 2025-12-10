import { useState, useEffect, useCallback } from "react";

// Cognito configuration - update these after deploying Cognito
const COGNITO_DOMAIN =
  process.env.REACT_APP_COGNITO_DOMAIN ||
  "https://prop-sheet.auth.us-east-1.amazoncognito.com";
const CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID || "";
const REDIRECT_URI = window.location.origin + "/";

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "prop_sheet_access_token",
  ID_TOKEN: "prop_sheet_id_token",
  REFRESH_TOKEN: "prop_sheet_refresh_token",
  CODE_VERIFIER: "prop_sheet_code_verifier",
  USER: "prop_sheet_user",
};

// PKCE helpers
const generateRandomString = (length) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return hash;
};

const base64UrlEncode = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const generateCodeChallenge = async (verifier) => {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
};

// Parse JWT to get user info
const parseJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if we have a valid session on mount
  useEffect(() => {
    const checkSession = () => {
      const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

      if (idToken && storedUser) {
        // Check if token is expired
        const payload = parseJwt(idToken);
        if (payload && payload.exp * 1000 > Date.now()) {
          setUser(JSON.parse(storedUser));
        } else {
          // Token expired, clear storage
          clearAuthStorage();
        }
      }
      setIsLoading(false);
    };

    // Handle OAuth callback
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const storedVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);

      if (code && storedVerifier) {
        setIsLoading(true);
        try {
          await exchangeCodeForTokens(code, storedVerifier);
          // Clean up URL
          window.history.replaceState({}, document.title, "/");
        } catch (err) {
          console.error("Failed to exchange code:", err);
          setError("Authentication failed. Please try again.");
        }
        localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
        setIsLoading(false);
      } else {
        checkSession();
      }
    };

    handleCallback();
  }, []);

  const clearAuthStorage = () => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setUser(null);
  };

  const exchangeCodeForTokens = async (code, verifier) => {
    const tokenEndpoint = `${COGNITO_DOMAIN}/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await response.json();

    // Store tokens
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, tokens.id_token);
    if (tokens.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    }

    // Parse user info from ID token
    const payload = parseJwt(tokens.id_token);
    const userData = {
      email: payload.email,
      name: payload.name || payload.email,
      sub: payload.sub,
    };

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const signIn = useCallback(async () => {
    if (!CLIENT_ID) {
      setError("Authentication not configured. Please set REACT_APP_COGNITO_CLIENT_ID.");
      return;
    }

    // Generate PKCE code verifier and challenge
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);

    // Store verifier for token exchange
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);

    // Build authorization URL
    const authUrl = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "email openid profile");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("identity_provider", "Google");

    // Redirect to Cognito hosted UI
    window.location.href = authUrl.toString();
  }, []);

  const signOut = useCallback(() => {
    clearAuthStorage();

    // Optionally redirect to Cognito logout
    if (CLIENT_ID) {
      const logoutUrl = new URL(`${COGNITO_DOMAIN}/logout`);
      logoutUrl.searchParams.set("client_id", CLIENT_ID);
      logoutUrl.searchParams.set("logout_uri", REDIRECT_URI);
      window.location.href = logoutUrl.toString();
    }
  }, []);

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }, []);

  const getIdToken = useCallback(() => {
    return localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  }, []);

  return {
    user,
    isLoading,
    error,
    signIn,
    signOut,
    getAccessToken,
    getIdToken,
    isAuthenticated: !!user,
  };
};

export default useAuth;
