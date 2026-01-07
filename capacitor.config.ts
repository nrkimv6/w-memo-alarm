import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.woory.memoalarm',
	appName: 'Memo Alarm',
	webDir: 'build',
	plugins: {
		LocalNotifications: {
			smallIcon: 'ic_stat_icon',
			iconColor: '#8B5CF6'
		}
	}
};

export default config;
