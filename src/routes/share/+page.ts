import type { PageLoad } from './$types';
import { parseSharedDataFromParams, sharedDataToMemoDefaults } from '$lib/utils/shareReceiver';

export const load: PageLoad = ({ url }) => {
	const sharedData = parseSharedDataFromParams(url.searchParams);

	if (!sharedData) {
		return {
			hasData: false,
			defaults: null
		};
	}

	const defaults = sharedDataToMemoDefaults(sharedData);

	return {
		hasData: true,
		defaults,
		raw: sharedData
	};
};
