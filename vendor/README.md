# vendor

館が読む表示の道具を、外の CDN（jsdelivr）に頼らずに館の中に置いた写し（2026-10-08。CDN が 503 を返すと館が立ち上がらなかったため）。

- `three/`：three.js 0.170.0（MIT License・`three/LICENSE`）。build/three.module.js と、使う addons（RoomEnvironment・BufferGeometryUtils・GLTFLoader・meshopt_decoder）だけ。
- `three-vrm/`：@pixiv/three-vrm 3.5.5（MIT License・`three-vrm/LICENSE`）。

版を上げるときは、同じ道すじで取りなおす（index.html の importmap はここを指す）。
