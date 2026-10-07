import 'package:barr/core/storage/local_db.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<(LocalDb, SharedPreferences)> createLocalDb([Map<String, Object> initial = const {}]) async {
  SharedPreferences.setMockInitialValues(initial);
  final prefs = await SharedPreferences.getInstance();
  return (LocalDb(prefs), prefs);
}
