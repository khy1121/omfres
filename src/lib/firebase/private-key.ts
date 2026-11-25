// FIREBASE_PRIVATE_KEY 환경변수를 PEM 문자열로 정규화한다.
// 배포 대시보드에 붙여 넣는 방식에 따라 형태가 달라지므로 흔한 경우를 모두 받아들인다.
// - .env 파일처럼 양 끝 큰따옴표(또는 작은따옴표)까지 붙여 넣은 경우
// - 줄바꿈이 문자 그대로의 "\n"으로 들어온 경우 / Windows 줄바꿈(\r\n)
// - 서비스 계정 JSON 전체를 붙여 넣은 경우 (private_key 필드 사용)

export function normalizePrivateKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let key = raw.trim();

  if (key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key) as { private_key?: unknown };
      if (typeof parsed.private_key === "string") key = parsed.private_key.trim();
    } catch {
      // JSON이 아니면 그대로 진행
    }
  }

  // 양 끝 따옴표가 여러 겹이어도 벗긴다
  while (key.length >= 2 && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n");
  if (!key.endsWith("\n")) key += "\n";
  return key;
}
