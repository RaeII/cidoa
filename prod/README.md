# Front — produção

Imagem de produção gerada e publicada localmente; servidor apenas puxa do GHCR.

## Arquivos de produção

A pasta `prod/` contém apenas os arquivos para deploy e estas instruções.

```text
prod/
├── docker-compose.yml          # Deploy usando somente imagem pronta
├── .env.example                # Configuração de produção
└── README.md                   # Build da imagem de produção e deploy
```

Arquivos usados para gerar a imagem ficam fora de `prod/`: [Dockerfile](../Dockerfile), [.dockerignore](../.dockerignore) e [docker/nginx.conf](../docker/nginx.conf).

| Branch | Imagem | Porta publicada |
| --- | --- | --- |
| `beta` | `ghcr.io/raeii/cidoa-front:prelaunch` | `6161` |
| `main` | `ghcr.io/raeii/cidoa-front:main` | `6161` |

Uma versão ativa por vez. Tag identifica a imagem; comportamento de pré-lançamento vem do código da branch.

## Na máquina local — build da imagem de produção

Execute na **raiz do repositório**, na branch correspondente. PAT classic com `write:packages`; informe token no prompt do login.

```bash
docker login ghcr.io -u RaeII
```

Na branch `beta`:

```bash
docker buildx build --platform linux/amd64 --pull --load -t ghcr.io/raeii/cidoa-front:prelaunch .
docker push ghcr.io/raeii/cidoa-front:prelaunch
```

Na branch `main`:

```bash
docker buildx build --platform linux/amd64 --pull --load -t ghcr.io/raeii/cidoa-front:main .
docker push ghcr.io/raeii/cidoa-front:main
```

Use `linux/arm64` se servidor ARM. Dockerfile e `.dockerignore` ficam na raiz; configuração do Nginx em `docker/nginx.conf` é embutida na imagem. Contexto do build é a raiz (`.`). Bun instala pelo lockfile e compila na arquitetura da máquina (`--platform=$BUILDPLATFORM`): `dist` é estático, independe de CPU. Bun emulado (Mac ARM → amd64) trava com `Segmentation fault`/`SIGILL` e demora. Imagem final contém apenas Nginx, `dist` e configuração do proxy. `.env` local não entra no build; `/api` fixo. Google OAuth mantém Client ID público existente; autorize domínio de produção no Google e configure mesmo ID no backend.

Pacote `cidoa-front` vinculado a [RaeII/cidoa](https://github.com/RaeII/cidoa) pelo label `org.opencontainers.image.source` do Dockerfile: aparece em **Packages** na lateral do repo. Mesmo LABEL sobrescreve título, descrição e versão herdados da imagem base. Pacote nasce privado (repo público); visibilidade muda em *Package settings*.

## No servidor — configuração e deploy

Copie a pasta `prod/` para a pasta do front no servidor, mantendo o nome `prod`. Não é necessário copiar o código, Dockerfile ou configuração do Nginx: a imagem publicada já contém a aplicação.

Backend tem sua própria pasta `prod/`; siga o README dele e suba o backend primeiro para criar a rede `cidoa`.

No servidor, entre na pasta do projeto e acesse `prod/`:

```bash
cd prod
```

Todos os comandos de deploy, atualização e operação abaixo são executados nessa pasta. Na primeira instalação, crie o arquivo de configuração:

```bash
cp .env.example .env
chmod 600 .env
```

Edite `prod/.env` antes do deploy. Em atualização, preserve o arquivo existente. O `.env` da raiz do repositório não é usado por este Compose.

Confira `FRONT_IMAGE` e `FRONT_PORT=6161` no `.env`. Para imagem privada, login no servidor usa PAT classic com `read:packages`.

```bash
docker login ghcr.io -u RaeII
docker compose config --quiet
docker compose pull
docker compose up -d --no-build
```

### Atualizar ou trocar beta/main

Na mesma pasta de produção, ajuste `FRONT_IMAGE` no `.env` e execute:

```bash
docker compose pull
docker compose up -d --no-build
```

Se usar pastas diferentes, pare o front anterior com `docker compose down` antes de subir o outro. Para rollback, publique tags únicas por versão e use tag ou digest em `FRONT_IMAGE`.

### Conferir operação

```bash
docker compose ps
docker compose logs --tail=100
```

Healthcheck indica falha; `restart: unless-stopped` reinicia processo encerrado, não container apenas unhealthy.

## Rede e proxy

`HTTPS → proxy do host → 127.0.0.1:6161 → front:8080 → api:3000 → PostgreSQL`.

- Front publicado só em loopback; Nginx mantém porta interna `8080`. Proxy HTTPS no host aponta para `127.0.0.1:6161`.
- Se proxy externo também for container, conecte-o à rede `cidoa` e use `front:8080`.
- HTTPS necessário para cookies `Secure` do backend. Proxy externo sobrescreve `Host`, `X-Forwarded-For` e `X-Forwarded-Proto` com host público, IP real e protocolo HTTPS. Backend usa `TRUST_PROXY=2` para os dois proxies; ajuste se cadeia mudar.
- `/api` preserva caminho, query, corpo e cookies. Erros da API não viram HTML da SPA; rotas React recebem `index.html`; assets ausentes retornam 404.
- DNS Docker acompanha mudanças de IP do backend. Sem porta pública da API.

Container sem root, filesystem somente leitura, capabilities removidas, `no-new-privileges`, healthcheck e logs limitados.

Referências: [Bun Docker](https://bun.sh/guides/ecosystem/docker), [Nginx sem root](https://github.com/nginx/docker-nginx-unprivileged), [contexto e ignore do Docker](https://docs.docker.com/build/concepts/context/#filename-and-location), [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
