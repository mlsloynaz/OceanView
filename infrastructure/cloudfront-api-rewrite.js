/**
 * CloudFront Function (viewer request) for /api/* behavior.
 *
 * Strips the /api prefix before the request hits API Gateway.
 * Pair with an origin whose "Origin path" is /prod.
 *
 * Example: viewer GET /api/tickers → origin GET /prod/tickers
 *
 * Create in AWS Console: CloudFront → Functions → Create function
 * Publish, then attach to the /api/* cache behavior (viewer request).
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.indexOf("/api/") === 0) {
    request.uri = uri.substring(4);
  } else if (uri === "/api") {
    request.uri = "/";
  }

  return request;
}
