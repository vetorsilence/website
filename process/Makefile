.PHONY: build
build:
	docker build -t ${IMAGE_TAG} .

.PHONY: ngrok
ngrok:
	ngrok http 8080

.PHONY: process
process:
	npm start

.PHONY: serve
serve:
	npm start
