// Award input
// ------------
// NOTE • A dropdown of the awards the chosen organisation gives (its
// `awards` list), so editors pick rather than retype. Lives beside the
// `body` reference in a case study's award item.

// Imports
// ------------
import { Select } from '@sanity/ui';
import { type ChangeEvent, useEffect, useState } from 'react';
import { type StringInputProps, set, unset, useClient, useFormValue } from 'sanity';

// Constants
// ------------
const API_VERSION = '2025-06-01';
// NOTE • Prefer the draft so awards added to an unpublished organisation show up straight away
const AWARDS_QUERY = '*[_id in [$id, "drafts." + $id]] | order(_updatedAt desc)[0].awards';

// Component
// ------------
export const AwardInput = (props: StringInputProps) => {
	// Context
	const client = useClient({ apiVersion: API_VERSION });
	const body = useFormValue([...props.path.slice(0, -1), 'body']) as { _ref?: string } | undefined;

	// State
	const [awards, setAwards] = useState<string[]>([]);

	// Effects
	useEffect(() => {
		if (!body?._ref) return setAwards([]);
		const params = { id: body._ref };
		const load = () => client.fetch<string[] | null>(AWARDS_QUERY, params).then(list => setAwards(list ?? []));
		load();
		const subscription = client.listen(AWARDS_QUERY, params, { visibility: 'query' }).subscribe(load);
		return () => subscription.unsubscribe();
	}, [client, body?._ref]);

	// Derived
	const { value, readOnly, elementProps } = props;
	const isStale = Boolean(value && !awards.includes(value));

	// Handlers
	const handleChange = (event: ChangeEvent<HTMLSelectElement>) =>
		props.onChange(event.currentTarget.value ? set(event.currentTarget.value) : unset());

	// Render
	return (
		<Select
			id={elementProps.id}
			ref={elementProps.ref}
			onFocus={elementProps.onFocus}
			onBlur={elementProps.onBlur}
			value={value ?? ''}
			onChange={handleChange}
			readOnly={readOnly}
			disabled={!body?._ref}
		>
			<option value=''>{body?._ref ? 'Choose an award…' : 'Choose an organisation first'}</option>
			{isStale && <option value={value}>{value} (not in this organisation’s list)</option>}
			{awards.map(award => (
				<option key={award} value={award}>
					{award}
				</option>
			))}
		</Select>
	);
};
