import { customAlphabet } from "nanoid";
import { FindOptionsWhere } from "typeorm";
import * as crypto from "crypto";

type NonFunction<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

type StrippableWhere<T> = {
  [K in keyof FindOptionsWhere<NonFunction<T>>]?:
    | FindOptionsWhere<NonFunction<T>>[K]
    | undefined;
};

type StrictFindOptionsWhere<T> = FindOptionsWhere<T>;

/**
 * 객체에서 undefined 값을 가진 속성을 제거하고,
 * 그 결과 객체의 정확한 타입 (TypeORM FindOptionsWhere)을 추론합니다.
 * 빈 객체가 될 경우, 스프레드 연산을 위해 {}를 반환합니다.
 */
export function stripUndefined<T>(
  obj: StrippableWhere<T>,
): StrictFindOptionsWhere<T> {
  const stripped = Object.keys(obj).reduce((acc: any, prop) => {
    if (obj[prop] !== undefined) {
      acc[prop] = obj[prop];
    }
    return acc;
  }, {});

  // [수정] 빈 객체일 경우 스프레드 연산의 안전성을 위해 {}를 반환합니다.
  if (Object.keys(stripped).length === 0) {
    return {} as StrictFindOptionsWhere<T>;
  }

  // 최종 결과는 TypeORM 검색 조건 객체 타입으로 단언하여 반환합니다.
  return stripped as StrictFindOptionsWhere<T>;
}

// NOTE: 랜덤 문자열 리턴
export function generateRandomString(num: number) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// NOTE: Entity ID 미리 생성하기 위함.
export function randomId() {
  return customAlphabet(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    10,
  )();
}

//전달받은 html 텍스트에서 모든 이미지 태그를 추출해서 배열로 만들고 항상 첫번째 값을 반환 하는 함수
export function parseHtmlImageTags(text: string) {
  const imgTags = text.match(/<img[^>]+src="([^"]+)"/g);
  return imgTags?.map((tag) => tag.split('src="')[1].split('"')[0])[0];
}

const algorithm = "aes-256-cbc";
const key = crypto.scryptSync("puddingtoon_temp_token_secret_key", "salt", 32);

export function encryption(text: string) {
  // 매번 새로운 IV 생성 (보안 향상)
  const iv = crypto.randomBytes(16);

  // 암호화
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // IV를 암호문 앞에 붙여서 반환 (iv:encrypted 형태)
  return iv.toString("hex") + ":" + encrypted;
}

export function decryption(token: string) {
  // IV와 암호문 분리
  const [ivHex, encrypted] = token.split(":");
  const iv = Buffer.from(ivHex, "hex");

  // 복호화
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
