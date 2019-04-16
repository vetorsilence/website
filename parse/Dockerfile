FROM ubuntu:latest

# Install various tools.
RUN apt-get update && \
	apt-get upgrade -y && \
    apt-get install -y \
	ffmpeg \
	git-core \
	curl \
	wget \
	exiftran \
	unzip \
	make \
	python

# Install Node and NPM.
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs

# Install Exiftool.
ENV EXIFTOOL_VERSION=10.20
RUN cd /tmp \
	&& wget http://www.sno.phy.queensu.ca/~phil/exiftool/Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz \
	&& tar -zxvf Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz \
	&& cd Image-ExifTool-${EXIFTOOL_VERSION} \
	&& perl Makefile.PL \
	&& make test \
	&& make install \
	&& cd .. \
	&& rm -rf Image-ExifTool-${EXIFTOOL_VERSION}

# Install the AWS CLI.
RUN python -V
RUN wget https://s3.amazonaws.com/aws-cli/awscli-bundle.zip
RUN unzip awscli-bundle.zip
RUN ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws

# Create the app directory.
WORKDIR /usr/src/app

# Copy the app into the container.
COPY package*.json index.js ./

# Install.
RUN npm install

# And go!
EXPOSE 8080
CMD [ "npm", "start" ]
