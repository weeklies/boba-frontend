import { NextPageContext } from "next/dist/next-server/lib/utils";

export const getCurrentHost = (
  context: NextPageContext | undefined,
  withPort?: boolean
) => {
  const serverHost = context?.req?.headers.host;
  return typeof window !== "undefined"
    ? window.location.hostname
    : serverHost?.substr(
        0,
        withPort || serverHost?.indexOf(":") == -1
          ? undefined
          : serverHost?.indexOf(":")
      );
};

const SANDBOX_LOCATIONS = ["tys-sandbox.boba.social"];
export const isSandbox = (context: NextPageContext | undefined) => {
  if (process.env.NEXT_PUBLIC_TEST_SANDBOX === "true") {
    return true;
  }
  const currentHost = getCurrentHost(context);
  return currentHost && SANDBOX_LOCATIONS.includes(currentHost);
};

const ALLOWED_SANDBOX_LOCATIONS = {
  ["localhost"]: [
    "/!gore/thread/8b2646af-2778-487e-8e44-7ae530c2549c",
    "/!anime/thread/b27710a8-0a9f-4c09-b3a5-54668bab7051",
  ],
  "tys-sandbox.boba.social": [
    "/!challenge/thread/659dc185-b10d-4dbb-84c5-641fc1a65e58",
    "/!steamy/thread/9719a1dd-96da-497e-bd71-21634c20416c",
  ],
};
export const isAllowedSandboxLocation = (
  context: NextPageContext | undefined
) => {
  if (
    !context ||
    !context.asPath ||
    !isSandbox(context) ||
    !getCurrentHost(context)
  ) {
    return true;
  }
  const currentHost = getCurrentHost(context)!;
  return ALLOWED_SANDBOX_LOCATIONS[currentHost].includes(context.asPath);
};

export const getRedirectToSandboxLocation = (
  context?: NextPageContext | undefined
) => {
  const currentHost = getCurrentHost(context);
  if (!currentHost || !isSandbox(context)) {
    throw new Error(
      "No valid current host in sandbox location, or tried sandbox redirect in non-sandbox environment."
    );
  }
  return ALLOWED_SANDBOX_LOCATIONS[currentHost][0];
};

export const isLocalhost = (context?: NextPageContext) => {
  const currentHost = getCurrentHost(context);
  return !!(
    currentHost?.startsWith("localhost") || currentHost?.startsWith("192.")
  );
};

export const isStaging = (context?: NextPageContext) => {
  if (process.env.NEXT_PUBLIC_ENV == "staging") {
    return true;
  }
  const currentHost = getCurrentHost(context);
  return !!currentHost?.startsWith("staging");
};

export const getServerBaseUrl = (context?: NextPageContext) => {
  const staging = isStaging(context);
  if (process.env.NODE_ENV == "production") {
    return staging
      ? "https://staging-dot-backend-dot-bobaboard.uc.r.appspot.com/"
      : "https://backend-dot-bobaboard.uc.r.appspot.com/";
  }

  if (process.env.NEXT_PUBLIC_DEFAULT_BACKEND) {
    return process.env.NEXT_PUBLIC_DEFAULT_BACKEND;
  }

  let backendLocation = "";
  const localhost = isLocalhost(context);
  if (localhost) {
    backendLocation = getCurrentHost(context) || "localhost";
  } else if (staging) {
    backendLocation = `staging-dot-backend-dot-bobaboard.uc.r.appspot.com`;
  } else {
    backendLocation = "backend-dot-bobaboard.uc.r.appspot.com";
  }

  // Remove the port if there is currently one
  if (backendLocation.indexOf(":") != -1) {
    backendLocation = backendLocation.substring(
      0,
      backendLocation.indexOf(":")
    );
  }

  return localhost
    ? `http://${backendLocation}:4200/`
    : `https://${backendLocation}/`;
};