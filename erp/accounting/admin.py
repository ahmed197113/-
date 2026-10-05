from django.contrib import admin

from .models import Account, AccountMapping, Company, CostCenter, Partner, Tax

for m in (Company, Account, AccountMapping, CostCenter, Partner, Tax):
    admin.site.register(m)
