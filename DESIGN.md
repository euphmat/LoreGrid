# LoreGrid 設計書

## 1. プロダクト方針

LoreGrid は、ユーザーが定義したDB列で情報を「項目」として統一的に管理し、表と空間の二つの見方を行き来できる静的 Web アプリケーションです。

中心となる原則は次の通りです。

- **一度入力すれば、どの View でも使える。** DB とボードは同じデータを描画・編集する。
- **キーボードだけで主要操作を完結できる。** 移動、作成、検索、表示切替、編集をショートカット化する。
- **作品を混ぜない。** ゲーム一本を一つのプロジェクトとして分離する。
- **ユーザーのデータを外部へ送らない。** LocalStorage で端末内に保存し、JSON で持ち出せる。
- **ジャンルを決めつけない。** 項目の種類と関連ラベルを汎用化し、RPG、ストラテジー、ADV、推理に対応する。

## 2. 情報設計

### Project

```js
{
  id,
  name,
  gameType,
  accent,
  description,
  bannerImageId,
  bannerImageName,
  columns: [{
    id,
    label,
    kind,
    options: [{ id, label, color }] // リスト項目の色付き候補
  }],
  createdAt,
  updatedAt,
  entities: Entity[]
}
```

### Entity

```js
{
  id,
  title,
  body,
  fields: {}, // columns の id をキーにした値
  imageId,    // IndexedDB images ストアの参照キー
  imageName,  // 元ファイル名
  organisation,
  groupColor,
  groupWidth,
  groupHeight,
  parentGroupId,
  links: [{ targetId, label }],
  x, y,       // ボード上の位置
  createdAt,
  updatedAt
}
```

関連は項目側に保持します。片方向でも表示上は相互にたどれ、ボードでは重複を除いて線に変換します。

### AppState

```js
{
  schemaVersion: 3,
  activeProjectId,
  activeEntityId,
  settings: {
    theme,
    view,
    query,
    sort,
    boardZoom,
    sidebarCollapsed
  },
  projects: Project[]
}
```

## 3. 画面と操作

### ヘッダー

- 現在のプロジェクトと View を表示
- DB / Board 切替
- コマンドパレット
- JSON 書き出し
- ライト / ダーク切替
- 新規項目

### エクスプローラー

- プロジェクト切替・追加
- サイドバーの表示・非表示
- JSON 読み込み / 書き出し
- LocalStorage 保存状態

### DB View

一覧比較を優先した表形式です。名称と任意列を表示し、更新日時列は表示しません。列の追加・名称変更・型変更・削除とセル入力はDB表上で直接行います。

### Board View

関係性とまとまりを把握する空間 View です。余白ドラッグで表示領域を移動でき、カードのドラッグ位置と背景色は即時保存されます。`links` はラベル付きの線になります。

### Inspector

一覧の文脈を保ったまま内容を確認・編集する右ペインです。プレビューと編集UIを同時に表示し、入力は自動保存されます。

### Vim Editor

本文欄に Normal / Insert モードを実装します。主な Normal キーは `h/j/k/l`, `w/b`, `0/$`, `gg/G`, `i/a/I/A/o/O`, `x`, `dd`, `yy`, `p`, `u`。Insert 中は `Esc` または `jj` で Normal に戻ります。

## 4. 永続化と画像

- 状態変更は短い debounce を経て `localStorage["loregrid.state.v2"]` に保存。
- 画像本体は `IndexedDB["loregrid.assets.v1"]` の `images` ストアへ Blob として保存する。
- Entity と Project は画像本体を持たず、画像IDで IndexedDB のレコードを参照する。
- 表示時は Blob から一時的な Object URL を生成し、差し替え・削除時に破棄する。
- 画像は右側詳細パネルへのドラッグ＆ドロップ、またはファイル選択で保存する。
- JSON バックアップ時だけ画像BlobをData URLへ変換して `assets` に同梱し、読み込み時にIndexedDBへ復元する。

## 5. 配布

`index.html`, `js/`, `css/`, `Image/` の静的ファイルのみで動作し、GitHub Pages のリポジトリルート公開に対応します。ビルド工程は不要です。Tailwind CSS は静的 HTML 向け CDN ビルドを利用し、固有の UI 表現は CSS 変数とコンポーネント CSS で補完します。

JavaScript は状態・描画・データ操作・UI操作・ボード操作・インスペクター・Vim エディタ・イベント登録に分割しています。既存の配布方式を保つためクラシックスクリプトの共有レキシカルスコープを利用しており、`index.html` の読み込み順が依存順です。詳細は `js/README.md` を参照してください。

CSS は基盤・ワークスペース・DB・ボード・インスペクター・モーダル・レスポンシブに分割し、後から読み込むファイルが前段の共通スタイルを上書きします。詳細は `css/README.md` を参照してください。
