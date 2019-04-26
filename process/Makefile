docker_repo = "cnunciato/process"

.PHONY: build
build:
	docker build -t ${docker_repo}:$(shell date +%s) .

.PHONY: push
push:
	docker push ${docker_repo}

.PHONY: ngrok
ngrok:
	ngrok http 8080

.PHONY: start
serve_local:
	npm start

.PHONY: start
serve_docker: build
	docker run -it --rm \
		-p 8080:8080 \
		-e AWS_ACCESS_KEY_ID \
		-e AWS_SECRET_ACCESS_KEY \
		-e GITHUB_PERSONAL_ACCESS_TOKEN \
		$(shell docker images --format {{.ID}} | head -1)
