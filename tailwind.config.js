module.exports = {
	content: ['./src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				obsidian: {
					bg: 'var(--background-primary)',
					'bg-secondary': 'var(--background-secondary)',
					'bg-hover': 'var(--background-modifier-hover)',
					'bg-active':
						'var(--background-modifier-active-hover, var(--background-modifier-hover))',
					border: 'var(--background-modifier-border)',
					text: 'var(--text-normal)',
					'text-muted': 'var(--text-muted)',
					'text-faint': 'var(--text-faint)',
					accent: 'var(--interactive-accent)',
					interactive: 'var(--interactive-normal)',
					'interactive-hover': 'var(--interactive-hover)',
				},
			},
		},
	},
	plugins: [],
};
