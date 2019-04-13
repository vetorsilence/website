docker_repo = "cnunciato/parse"

.PHONY: build
build:
	docker build .

.PHONY: push
push:
	docker tag $(shell docker images --format {{.ID}} | head -1) ${docker_repo} && \
	docker push ${docker_repo}

.PHONY: ngrok
ngrok:
	ngrok http 8080

.PHONY: start
start: build
	docker run -it --rm \
		-p 8080:8080 \
		-e AWS_ACCESS_KEY_ID \
		-e AWS_SECRET_ACCESS_KEY \
		-e GITHUB_PERSONAL_ACCESS_TOKEN \
		$(shell docker images --format {{.ID}} | head -1)
