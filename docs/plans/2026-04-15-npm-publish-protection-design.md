# npm 发布保护：排除 src + 混淆 dist

**日期**：2026-04-15
**状态**：已批准

## 背景

当前 `npm publish` 会将 `src` 源码一并上传，且 `dist` 产物未做任何混淆保护。需要：
1. 从 npm 包中排除 `src` 目录
2. 对 `dist` 中的 JS 产物进行 minify + 变量名混淆
3. 删除 sourcemap 防止还原

## 方案选择

选定 **方案 A：bun build --minify** — 零额外依赖，改动最小。

## 具体改动

### 1. package.json — files 字段

```diff
- "files": ["dist", "src"]
+ "files": ["dist"]
```

### 2. package.json — 构建脚本

```diff
- "build:esm": "bun build ./src/index.ts --outdir ./dist --target node --format esm --packages external",
- "build:cjs": "bun build ./src/index.ts --outfile ./dist/index.cjs --target node --format cjs",
+ "build:esm": "bun build ./src/index.ts --outdir ./dist --target node --format esm --packages external --minify",
+ "build:cjs": "bun build ./src/index.ts --outfile ./dist/index.cjs --target node --format cjs --minify",
```

### 3. tsconfig.json — 移除 sourcemap

```diff
- "sourceMap": true,
- "declarationMap": true,
```

### 4. .d.ts 类型声明

保持原样发布，不做混淆。保证使用者的 TypeScript 类型提示体验。

## 影响范围

- `package.json` — files 字段 + build 脚本
- `tsconfig.json` — 移除 sourceMap/declarationMap
- 构建产物不再包含 `.map` 文件
- `prepublishOnly` 已有 verify 流程，无需额外改动
