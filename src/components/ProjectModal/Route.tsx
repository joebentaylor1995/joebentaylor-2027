'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { use, useLayoutEffect } from 'react';

// Styles + Interfaces
// ------------
import type * as I from './interface';

// Component
// ------------
// NOTE • Renders nothing: while the @modal slot shows a case study, this tells
// ProfileReveal to open its panel on it — and to let go once the route changes
const ProjectModalRoute = ({ href }: I.ProjectModalRouteProps) => {
	// Context
	const { registerProjectModal } = use(GlobalContext);

	// Effects
	// NOTE • Before paint, so the ribbon behind never flickers out of its active state
	useLayoutEffect(() => {
		registerProjectModal(href);
		return () => registerProjectModal(null);
	}, [href, registerProjectModal]);

	return null;
};

// Exports
// ------------
ProjectModalRoute.displayName = 'ProjectModalRoute';
export default ProjectModalRoute;
