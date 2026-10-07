import '../../../core/l10n/generated/app_localizations.dart';
import '../../../shared/domain/entities/enums.dart';

extension FamilyRoleLabel on FamilyRole {
  String label(AppLocalizations l) => switch (this) {
        FamilyRole.admin => l.roleAdmin,
        FamilyRole.caregiver => l.roleCaregiver,
        FamilyRole.viewer => l.roleViewer,
        FamilyRole.elder => l.roleElder,
      };
}

extension ElderRelationLabel on ElderRelation {
  String label(AppLocalizations l) => switch (this) {
        ElderRelation.father => l.relationFather,
        ElderRelation.mother => l.relationMother,
        ElderRelation.grandfather => l.relationGrandfather,
        ElderRelation.grandmother => l.relationGrandmother,
      };
}
