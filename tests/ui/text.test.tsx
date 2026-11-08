/**
 * Smoke test of the UI test chain: jest-expo, React Native Testing Library and test-renderer
 * rendering the NOUR Text component.
 */
import { render, screen } from '@testing-library/react-native';

import { Text } from '@/components/ui/text';

describe('Text', () => {
  it('announces display and title variants as headings', async () => {
    await render(<Text variant="title">Prières</Text>);
    expect(screen.getByRole('header', { name: 'Prières' })).toBeTruthy();
  });

  it('does not announce the body variant as a heading', async () => {
    await render(<Text>Cet écran sera disponible prochainement.</Text>);
    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.getByText('Cet écran sera disponible prochainement.')).toBeTruthy();
  });
});
