import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/l10n.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pages = PageController();
  final _name = TextEditingController();
  int _page = 0;

  static const _slideIcons = [
    Icons.psychology_alt_rounded,
    Icons.auto_graph_rounded,
    Icons.rocket_launch_rounded,
  ];

  @override
  void initState() {
    super.initState();
    _name.text = AppScope.read(context).name;
  }

  @override
  void dispose() {
    _pages.dispose();
    _name.dispose();
    super.dispose();
  }

  void _next() {
    if (_page == 4) {
      final app = AppScope.read(context);
      app.setName(_name.text);
      app.finishOnboarding();
      return;
    }
    FocusScope.of(context).unfocus();
    _pages.nextPage(
        duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: Brand.gradient),
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: PageView(
                  controller: _pages,
                  onPageChanged: (p) => setState(() => _page = p),
                  children: [
                    _language(app),
                    for (var i = 0; i < 3; i++) _slide(app, i),
                    _nameStep(app),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                child: Column(children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < 5; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: i == _page ? 26 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: Colors.white
                                .withValues(alpha: i == _page ? 1 : 0.4),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Brand.primary,
                    ),
                    onPressed: _next,
                    child: Text(_page == 4
                        ? app.t('common.start')
                        : app.t('common.next')),
                  ),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _language(AppState app) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 8),
      children: [
        const Center(child: LogoMark(size: 96)),
        const SizedBox(height: 18),
        const Text('Mirra',
            textAlign: TextAlign.center,
            style: TextStyle(
                color: Colors.white,
                fontSize: 36,
                fontWeight: FontWeight.w800,
                fontFamily: 'Poppins',
                letterSpacing: 1)),
        Text(app.t('app.tagline'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 16)),
        const SizedBox(height: 30),
        Text(app.t('onboarding.chooseLanguage'),
            style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 2.8,
          children: [
            for (final e in L10n.languages.entries)
              _LangTile(
                label: e.value,
                selected: app.locale == e.key,
                onTap: () => app.setLocale(e.key),
              ),
          ],
        ),
      ],
    );
  }

  Widget _slide(AppState app, int i) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(_slideIcons[i], size: 76, color: Colors.white),
          ),
          const SizedBox(height: 36),
          Text(app.t('onboarding.slides.$i.title'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          Text(app.t('onboarding.slides.$i.body'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white70, fontSize: 16, height: 1.6)),
        ],
      ),
    );
  }

  Widget _nameStep(AppState app) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(32, 80, 32, 8),
      children: [
        const Icon(Icons.waving_hand_rounded, size: 64, color: Brand.gold),
        const SizedBox(height: 24),
        Text(app.t('onboarding.nameTitle'),
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Text(app.t('onboarding.nameBody'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 15)),
        const SizedBox(height: 28),
        TextField(
          controller: _name,
          textAlign: TextAlign.center,
          textCapitalization: TextCapitalization.words,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: app.t('onboarding.nameHint'),
            fillColor: Colors.white,
          ),
          onSubmitted: (_) => _next(),
        ),
        const SizedBox(height: 18),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.lock_rounded, color: Colors.white70, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(app.t('onboarding.privacyNote'),
                  style: const TextStyle(color: Colors.white70, fontSize: 13)),
            ),
          ],
        ),
      ],
    );
  }
}

class _LangTile extends StatelessWidget {
  const _LangTile(
      {required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: selected ? Colors.white : Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (selected) ...[
                  const Icon(Icons.check_circle_rounded,
                      color: Brand.primary, size: 18),
                  const SizedBox(width: 6),
                ],
                Text(label,
                    style: TextStyle(
                        color: selected ? Brand.primary : Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 16)),
              ],
            ),
          ),
        ),
      );
}
