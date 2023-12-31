import type { Request, Response, NextFunction } from "express";

//
import sendPayload from "../utils/sendPayload.utils";
import generatePayload from "../utils/generatePayload.utils";
import maskSensitiveData from "../utils/maskSensitiveData.utils";
import getRequestDuration from "../utils/getRequestDuration.utils";

//
import type { ITreblleOptions } from "../types/treblle.types";

/**
 *
 */
export default function treblle(options?: ITreblleOptions) {
  // Checking if API key is provided or not
  const apiKey = options?.apiKey ?? process.env.TREBLLE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[Treblle.js] WARNING - Unable to connect to Treblle, missing apiKey!"
    );
  }

  // Checking if Project ID is provided or not
  const projectId = options?.projectId ?? process.env.TREBLLE_PROJECT_ID;
  if (!projectId) {
    console.warn(
      "[Treblle.js] WARNING - Unable to connect to Treblle, missing projectId!"
    );
  }

  /**
   *
   */
  return function expressMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (!apiKey || !projectId) {
      return next();
    }

    //
    const isDebugMode = options?.debug ?? false;
    const maskingKeys = options?.maskingKeys ?? [];

    //
    const excludedMethods =
      options?.excludeMethod?.map((metohd) => metohd.toUpperCase()) ?? [];

    // Checking if request method is excluded from tracking
    if (excludedMethods.includes(req.method)) {
      return next();
    }

    // Tracking the start tiem for the request
    const requestStartTime = process.hrtime();

    // The reponse body coming from the API
    let responseBody = "{}";

    // Getting the complete URL for the request
    const completeUrl = `${req.protocol}://${req.hostname}${req.originalUrl}`;

    //
    const originalSend = res.send;

    //
    res.send = function testSomething(body) {
      originalSend.call(this, body);

      // Storing the body response
      responseBody = body
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : "{}";

      return this;
    };

    //
    res.on("finish", () => {
      const requestBody = req.body ?? {};
      const requestQuery = req.query ?? {};

      const requestBodyPayload = { ...requestBody, ...requestQuery };
      const responseBodyPayload = JSON.parse(responseBody ?? "{}");

      //
      const trebllePayload = generatePayload({
        apiKey,
        projectId,
        ip: req.ip,
        url: completeUrl,
        protocol: req.protocol,
        request: {
          body: maskSensitiveData(requestBodyPayload, maskingKeys),
          headers: maskSensitiveData(req.headers, maskingKeys),
          method: req.method,
          userAgent: req.headers["user-agent"] ?? "",
        },
        reponse: {
          body: maskSensitiveData(responseBodyPayload, maskingKeys),
          headers: maskSensitiveData(res.getHeaders(), maskingKeys),
          loadTime: getRequestDuration(requestStartTime),
          size: res.get("content-length") ?? "",
          statusCode: res.statusCode,
        },
        errors: [],
      });

      //
      sendPayload(trebllePayload, apiKey, isDebugMode);
    });

    // Everything is alright, let's proceed
    next();
  };
}
