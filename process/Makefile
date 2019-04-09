docker_repo = "cnunciato/process"

build:
	docker build .

push:
	docker tag $(shell docker images --format {{.ID}} | head -1) ${docker_repo} && \
	docker push ${docker_repo}
