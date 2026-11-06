import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Results } from '../src/components/results';
import type { DuelResult } from '../src/lib/results';
const players=[{username:'Ada',before:800,after:808,passed:8,total:8,cpu:12.345,submitted:1250},{username:'Bob',before:800,after:792,passed:5,total:8,cpu:42,submitted:null}];
it.each(['WIN','LOSS','DRAW'] as const)('shows authoritative %s and side by side final metrics',outcome=>{
 render(<Results result={{title:'Sample',outcome,players}}/>);
 expect(screen.getByRole('heading',{name:outcome})).toBeVisible();
 expect(screen.getByLabelText('Rating change +8')).toBeVisible();
 expect(screen.getByLabelText('Rating change -8')).toBeVisible();
 expect(screen.getByText('12.35 ms')).toBeVisible();
 expect(screen.getByText('1.25 s')).toBeVisible();
 expect(screen.getByText('No submission')).toBeVisible();
 expect(screen.getByRole('link',{name:'New match'})).toHaveAttribute('href','/');
 expect(screen.queryByText('Rematch invitations are not available yet.')).not.toBeInTheDocument();
});
it('does not invent missing historical metrics or rating changes',()=>{
 const p={username:'Ada',before:null,after:null,passed:null,total:null,cpu:null,submitted:null};
 render(<Results result={{title:'Legacy',outcome:'DRAW',players:[p,{...p,username:'Bob'}]} as DuelResult}/>);
 expect(screen.getAllByText('Rating not recorded')).toHaveLength(2);
 expect(screen.getAllByText('Not recorded')).toHaveLength(6);
});
