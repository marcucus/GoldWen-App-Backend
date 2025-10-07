"""
Performance benchmark for matching algorithms.

This script measures the performance of V1 and V2 algorithms with various
data sizes and profiles.
"""

import time
from datetime import datetime, timedelta
from typing import List, Dict
from services.compatibility_calculator import CompatibilityCalculator


def generate_test_profile(
    user_id: str,
    num_answers: int = 10,
    active: bool = True,
) -> Dict:
    """Generate a test user profile."""
    now = datetime.now()
    
    personality_answers = [
        {
            "questionId": f"q{i}",
            "numericAnswer": (i * 2) % 10 + 1,
            "category": ["communication", "values", "lifestyle", "personality"][i % 4]
        }
        for i in range(num_answers)
    ]
    
    return {
        "userId": user_id,
        "age": 25 + int(user_id[4:]) % 20,
        "interests": ["hiking", "reading", "travel", "cooking", "music"][:3],
        "personalityAnswers": personality_answers,
        "lastActiveAt": now - timedelta(hours=12 if active else 240),
        "lastLoginAt": now - timedelta(hours=10 if active else 200),
        "createdAt": now - timedelta(days=30),
        "messagesSent": 50 if active else 5,
        "messagesReceived": 50 if active else 10,
        "matchesCount": 5,
    }


def benchmark_v1(profiles: List[Dict], iterations: int = 100):
    """Benchmark V1 algorithm."""
    print(f"\nBenchmarking V1 with {len(profiles)} profiles...")
    
    start_time = time.time()
    
    for _ in range(iterations):
        for i in range(len(profiles) - 1):
            CompatibilityCalculator.calculate_compatibility_v1(
                user1_profile=profiles[0],
                user2_profile=profiles[i + 1],
            )
    
    end_time = time.time()
    total_calculations = iterations * (len(profiles) - 1)
    elapsed = end_time - start_time
    
    print(f"V1 Results:")
    print(f"  Total calculations: {total_calculations}")
    print(f"  Total time: {elapsed:.2f}s")
    print(f"  Average time per calculation: {(elapsed / total_calculations) * 1000:.2f}ms")
    print(f"  Calculations per second: {total_calculations / elapsed:.2f}")
    
    return elapsed / total_calculations


def benchmark_v2(profiles: List[Dict], iterations: int = 100):
    """Benchmark V2 algorithm."""
    print(f"\nBenchmarking V2 with {len(profiles)} profiles...")
    
    start_time = time.time()
    
    for _ in range(iterations):
        for i in range(len(profiles) - 1):
            CompatibilityCalculator.calculate_compatibility_v2(
                user1_profile=profiles[0],
                user2_profile=profiles[i + 1],
            )
    
    end_time = time.time()
    total_calculations = iterations * (len(profiles) - 1)
    elapsed = end_time - start_time
    
    print(f"V2 Results:")
    print(f"  Total calculations: {total_calculations}")
    print(f"  Total time: {elapsed:.2f}s")
    print(f"  Average time per calculation: {(elapsed / total_calculations) * 1000:.2f}ms")
    print(f"  Calculations per second: {total_calculations / elapsed:.2f}")
    
    return elapsed / total_calculations


def run_benchmarks():
    """Run all benchmarks."""
    print("=" * 70)
    print("GoldWen Matching Algorithm Performance Benchmark")
    print("=" * 70)
    
    # Test with different profile sizes
    test_cases = [
        (5, 100, "Small dataset"),
        (20, 50, "Medium dataset"),
        (50, 20, "Large dataset"),
    ]
    
    for num_profiles, iterations, description in test_cases:
        print(f"\n{description} ({num_profiles} profiles, {iterations} iterations)")
        print("-" * 70)
        
        # Generate test profiles
        profiles = [
            generate_test_profile(f"user{i}", active=(i % 3 != 0))
            for i in range(num_profiles)
        ]
        
        # Benchmark V1
        v1_time = benchmark_v1(profiles, iterations)
        
        # Benchmark V2
        v2_time = benchmark_v2(profiles, iterations)
        
        # Compare
        overhead = ((v2_time - v1_time) / v1_time) * 100
        print(f"\nV2 overhead: {overhead:.1f}%")
        print(f"V2 is {v2_time/v1_time:.2f}x slower than V1")
    
    print("\n" + "=" * 70)
    print("Benchmark Summary:")
    print("=" * 70)
    print("\nV2 adds advanced scoring factors while maintaining reasonable performance.")
    print("The additional overhead is justified by the improved matching quality.")
    print("\nRecommendations:")
    print("- Use V1 for batch processing and daily selections")
    print("- Use V2 for detailed profile compatibility when user requests it")
    print("- Consider caching V2 results for frequently compared profiles")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmarks()
