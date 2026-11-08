'use client';

// Imports
// ------------
import { useGSAP } from '@gsap/react';
import { installFrameClock } from '@utils/frameClock';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Plugins
// ------------
// Side-effect module: registering once here keeps every consumer on the same plugin set
gsap.registerPlugin(ScrollTrigger, useGSAP);

// NOTE • gsap.ticker runs once per vsync with vsync time (see src/utils/frameClock.ts)
installFrameClock();
