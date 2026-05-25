export type WebHealth = {
  status: "ok";
  service: "web";
};

export function getWebHealth(): WebHealth {
  return {
    status: "ok",
    service: "web"
  };
}

