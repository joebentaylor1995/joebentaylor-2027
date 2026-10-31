'use client';

// Imports
// ------------
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Plugins
// ------------
// Side-effect module: registering once here keeps every consumer on the same plugin set
gsap.registerPlugin(ScrollTrigger, useGSAP);
