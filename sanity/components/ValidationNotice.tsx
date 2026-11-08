// Validation notice
// ------------
// NOTE • Sanity shows a field's warnings and errors as an icon you have to hover,
// and a grid tile's not at all. This spells them out as text above the field,
// so editors see what's wrong without hunting for it.

// Imports
// ------------
import { Card, Stack, Text } from '@sanity/ui';
import type { FormNodeValidation, InputProps } from 'sanity';

// Constants
// ------------
const TONES = { error: 'critical', warning: 'caution', info: 'primary' } as const;

// Component
// ------------
export const ValidationNotice = ({ validation }: { validation: FormNodeValidation[] }) => {
	// Render
	if (!validation.length) return null;
	return (
		<Stack gap={2}>
			{validation.map(({ level, message }) => (
				<Card key={`${level}-${message}`} tone={TONES[level]} padding={3} radius={2} border>
					<Text size={1}>{message}</Text>
				</Card>
			))}
		</Stack>
	);
};

// NOTE • As an input component: the field's own messages, then Sanity's default input
export const WithValidationNotice = (props: InputProps) => (
	<Stack gap={3}>
		<ValidationNotice validation={props.validation} />
		{props.renderDefault(props)}
	</Stack>
);
