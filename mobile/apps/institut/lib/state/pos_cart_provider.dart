import 'package:flutter_riverpod/flutter_riverpod.dart';

class PosCartNotifier extends StateNotifier<Map<String, int>> {
  PosCartNotifier() : super(const {});

  void add(String key) {
    state = {...state, key: (state[key] ?? 0) + 1};
  }

  void removeOne(String key) {
    final qty = (state[key] ?? 0) - 1;
    if (qty <= 0) {
      final next = Map<String, int>.from(state)..remove(key);
      state = next;
    } else {
      state = {...state, key: qty};
    }
  }

  void clear() => state = const {};

  int get totalItems => state.values.fold(0, (a, b) => a + b);
}

final posCartProvider =
    StateNotifierProvider<PosCartNotifier, Map<String, int>>((ref) {
  return PosCartNotifier();
});

final posCategoryFilterProvider = StateProvider<String>((ref) => 'all');
