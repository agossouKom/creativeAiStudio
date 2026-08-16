import { HttpInterceptorFn } from '@angular/common/http';
import { inject }            from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService }       from '../services/auth.service';

/** Ajoute le JWT Bearer sur chaque requête et redirige vers /auth sur 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const token = auth.getToken();

  const authReq = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {})
  });

  return next(authReq).pipe(
    catchError(err => {
      if ((err.status === 401 || err.status === 403) && token) {
        auth.logout('/auth');
      }
      return throwError(() => err);
    })
  );
};
