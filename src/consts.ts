// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Jordan Brong';
// TODO(jordan): review/rewrite the site description (used in <meta>, RSS, and the home page).
export const SITE_DESCRIPTION =
	'Notes and experiments on cloud security, AWS, and securing agentic workflows.';
export const AUTHOR_NAME = 'Jordan Brong';

export type SocialIcon = 'github' | 'linkedin' | 'rss';

export const SOCIAL_LINKS: { label: string; href: string; icon: SocialIcon }[] = [
	{ label: 'GitHub', href: 'https://github.com/Jbrong', icon: 'github' },
	{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/jordan-brong', icon: 'linkedin' },
	{ label: 'RSS feed', href: '/rss.xml', icon: 'rss' },
];
