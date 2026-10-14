import type { DB } from "./db";

/**
 * 저장소 갈아끼우는 자리
 *
 * 화면 쪽 코드는 어디에 저장되는지 몰라도 된다.
 *  - 회사 서버 (Firebase) : 어느 컴퓨터에서 열어도 같은 자료
 *  - 내 브라우저          : 설정이 없을 때 쓰는 임시 저장
 */
export interface Backend {
  /** 화면에 보여줄 이름 */
  name: string;
  /** 자료를 불러온다 */
  load(): Promise<Partial<DB>>;
  /** 자료를 저장한다 */
  save(db: DB): Promise<void>;
  /**
   * 큰 파일(사진·PPT)을 따로 올린다.
   * Firestore 는 문서 하나가 1MB 한도라 사진을 그대로 못 넣는다.
   */
  putFile?(key: string, dataUrl: string): Promise<string>;
  /** 로그인이 필요한 저장소인가 */
  needsLogin?: boolean;
}
