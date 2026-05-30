module.exports = {
	transform: {
		'^.+\\.tsx?$': [
			'babel-jest',
			{
				presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
			},
		],
	},
	testMatch: ['<rootDir>/src/**/*.test.ts'],
	moduleFileExtensions: ['ts', 'tsx', 'js'],
};
