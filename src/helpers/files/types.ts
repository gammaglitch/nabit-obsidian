export type StoredFile = {
	name: string;
	path: string;
	data: {
		content: string;
	};
};

export type StoredFileMap = Map<string, StoredFile>;
