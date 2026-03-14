# Codex Multi-Agent Monitor

이 저장소는 `React + Vite + Tauri v2` 최소 스캐폴드로 초기화됐다. 현재 화면은 단순한 `Hello World` UI만 포함한다.

## 환경

- Node.js `20.19+`
- pnpm `10+`
- Rust toolchain

## 실행

```bash
pnpm install
pnpm tauri:dev
```

## 기본 검증

```bash
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```
