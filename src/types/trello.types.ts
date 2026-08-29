/* 
**
* These are types of responses returned by the Trello API. 
* They are used to type the responses from the API calls in the tests.
**
*/


export interface TrelloBoard {
    id: string;
    name: string;
    desc: string;
    closed: boolean;
    url: string;
    shortUrl: string;
    idOrganization: string | null;
}

export interface TrelloList {
    id: string;
    name: string;
    closed: boolean;
    idBoard: string;
    pos: number;
}

export interface TrelloCard {
    id: string;
    name: string;
    desc: string;
    closed: boolean;
    idList: string;
    idBoard: string;
    pos: number;
    due: string | null;
    dueComplete: boolean;
    url: string;
}









// Shape Trello uses for rate-limit errors. Other errors return plain text.
export interface TrelloError {
    error?: string;
    message?: string;
}