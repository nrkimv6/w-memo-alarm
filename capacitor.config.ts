import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.woory.memoalarm',
	appName: 'Memo Alarm',
	webDir: 'build',
	server: {
		androidScheme: 'https'
	},
	plugins: {
		LocalNotifications: {
			smallIcon: 'ic_stat_icon',
			iconColor: '#4d8066'
		},
		SplashScreen: {
			launchShowDuration: 2000,
			backgroundColor: '#4d8066',
			showSpinner: false
		}
	},
	android: {
		allowMixedContent: true
	}
};

export default config;
