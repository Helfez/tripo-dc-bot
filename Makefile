version = 1.0.7
latest_commit := $(shell git rev-parse --short HEAD)
versionStr := v$(version).$(latest_commit)

REGISTRY_US = crpi-r4da0699win11k0h.us-west-1.personal.cr.aliyuncs.com/tripo-3d/dc-ts

.PHONY: dc-ts, docker

dc-ts:
	rm -rf dist
	$(MAKE) IMAGE_URL=$(REGISTRY_US):v$(version).$(latest_commit) docker

docker:
	docker build --platform linux/amd64 . -t ${IMAGE_URL}
	docker push ${IMAGE_URL}
