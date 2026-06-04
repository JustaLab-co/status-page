# Bakes the Gatus config into the image so Fly has no file to mount.
# Rebuild + `fly deploy` whenever you change config.yaml.
FROM twinproduction/gatus:latest
COPY config.yaml /config/config.yaml
