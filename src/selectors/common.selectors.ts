export const COMMON_SELECTORS = {
	authMeta: 'meta[name="msapplication-starturl"]',
	schoolNameMeta: 'meta[name="application-name"]',
	title: "title",
	aspNetForm: "#aspnetForm",

	aspNetFields: {
		viewStateX: "#__VIEWSTATEX",
		viewState: "#__VIEWSTATE",
		viewStateYKey: "#__VIEWSTATEY_KEY",
		eventTarget: "#__EVENTTARGET",
		eventArgument: "#__EVENTARGUMENT",
		eventValidation: "#__EVENTVALIDATION",
		scrollPosition: "#__SCROLLPOSITION",
		masterFooterValue: 'input[name="masterfootervalue"]',
	},
} as const;

export const AUTH_PATTERNS = {
	elevIdParam: /[?&]elevid=(\d+)/,
	teacherIdParam: /[?&]laererid=(\d+)/,
	loginPageIndicator: /unilogin|log\s*ind/i,
	schoolIdFromUrl: /\/lectio\/(\d+)\//,
} as const;
