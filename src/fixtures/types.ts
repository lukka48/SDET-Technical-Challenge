export interface UserData {
  userName: string;
  password: string;
}

export interface Book {
  isbn: string;
  title: string;
  subTitle?: string;
  author: string;
  publish_date?: string;
  publisher?: string;
  pages?: number;
  description?: string;
  website?: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  books: Book[];
}

export interface TokenRequest {
  userName: string;
  password: string;
}

export interface TokenResponse {
  token: string | null;
  expires: string | null;
  status: 'Success' | 'Failed';
  result: string;
}

export interface RegisterResponse {
  userID: string;
  username: string;
  books: Book[];
}

export interface AddBookPayload {
  userId: string;
  collectionOfIsbns: { isbn: string }[];
}

export interface AddBookResponse {
  books: { isbn: string }[];
}

export interface BookListResponse {
  books: Book[];
}
