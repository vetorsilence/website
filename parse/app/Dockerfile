FROM cnunciato/process

# Install Node and NPM.
RUN apt-get install -y nodejs npm
RUN node -v
RUN npm -v

# Create the app directory.
WORKDIR /usr/src/app

# Copy everything in.
COPY . .

# Install.
RUN npm install

# And go!
EXPOSE 8080
ENTRYPOINT [ "npm", "start" ]
