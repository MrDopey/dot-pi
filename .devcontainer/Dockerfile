FROM node:26.1.0-trixie

ARG USER_ID=1001
ARG GROUP_ID=1001
ARG USERNAME=lovely

RUN $(groupadd -g $GROUP_ID $USERNAME || true) && \
    useradd -m -s /bin/bash -u $USER_ID -g $GROUP_ID $USERNAME

# Install basic development tools
RUN apt update && apt install -y less man-db sudo

# Ensure default `node` user has access to `sudo`
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Install Pi
RUN curl -fsSL https://pi.dev/install.sh | sh && \
    apt-get update && \
    apt-get install fd-find \
    ripgrep

USER $USERNAME
