import { HttpInterceptorFn } from '@angular/common/http';
import { inject }            from '@angular/core';
import { Router }            from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService }       from '../services/auth.service';

/** Ajoute le JWT Bearer sur chaque requête et redirige vers /auth sur 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const token  = auth.getToken();

  const authReq = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {})
  });

  return next(authReq).pipe(
    catchError(err => {
      // 401 = session morte (JWT 24 h sans refresh). On redirige même quand le
      // jeton a déjà été vidé : sinon la condition `token` coupait la
      // redirection et l'app restait sur une page morte qui ne faisait que
      // renvoyer des 401 (constaté sur /docfusion, tous les appels en 401).
      if (err.status === 401 && !router.url.startsWith('/auth')) {
        auth.logout();
      } else if (err.status === 403 && token) {
        auth.logout();
      }
      return throwError(() => err);
    })
  );
};
