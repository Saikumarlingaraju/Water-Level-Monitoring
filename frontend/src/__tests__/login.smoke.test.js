import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Login from '../pages/Login';

const mockLogin = jest.fn().mockResolvedValue({});

jest.mock('../auth', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe('Login page smoke', () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  test('submits username and password', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledWith({ username: 'demo', password: 'password123' });
    });
  });
});
