import {RouterModule, Routes} from '@angular/router';
import {NgModule} from '@angular/core';
import {DashboardComponent} from './dashboard.component';
import {DashboardHomeComponent} from './home/dashboard-home.component';
import {NotFoundDashboardComponent} from '../not-found/dashboard/not-found-dashboard.component';
import {RoleGuard} from '../../@core/guards/role.guard';
import {Role} from '../../@core/models/role.model';
import {RunInfoComponent} from './runs/run-info/run-info.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      {
        path: 'maps',
        loadChildren: 'app/pages/dashboard/maps/map.module#MapModule',
      },
      {
        path: 'stats',
        loadChildren: 'app/pages/dashboard/stats/stats.module#StatsModule',
      },
      {
        path: 'community',
        loadChildren: 'app/pages/dashboard/community/community.module#CommunityModule',
      },
      {
        path: 'profile',
        loadChildren: 'app/pages/dashboard/profile/profile.module#ProfileModule',
      },
      {
        path: 'admin',
        loadChildren: 'app/pages/dashboard/admin/admin.module#AdminModule',
        canActivate: [RoleGuard],
        data: {
          onlyAllow: [
            Role.MODERATOR,
            Role.ADMIN,
          ],
        },
      },
      {
        path: 'runs',
        children: [
          {
            path: ':id',
            component: RunInfoComponent,
          },
        ],
      },
      {
        path: '',
        component: DashboardHomeComponent,
      },
      {
        path: '**',
        component: NotFoundDashboardComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [RoleGuard],
})
export class DashboardRoutingModule {
}
