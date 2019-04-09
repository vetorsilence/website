FROM ubuntu:disco
RUN apt-get update

# Install ffmpeg.
RUN apt-get install -y ffmpeg
RUN ffmpeg -h

# Install Node and NPM.
RUN apt-get install -y nodejs npm
RUN node -v
RUN npm -v

# Install Git.
RUN apt-get install -y git-core
RUN git --version

# Install Exiftool.
RUN apt-get install -y wget
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
RUN exiftool -ver

# Install the AWS CLI.
RUN python -V
RUN apt-get install -y unzip
RUN wget https://s3.amazonaws.com/aws-cli/awscli-bundle.zip
RUN unzip awscli-bundle.zip
RUN ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
RUN aws --version

# Copy in the processing script.
COPY scripts/process.sh /usr/local/bin

# Set a working directory to be mounted at runtime.
RUN mkdir -p media

# And go!
ENTRYPOINT [ "process.sh", "media" ]
